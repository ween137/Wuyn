import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";
import { corsHeaders } from "../_shared/cors.ts";
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,"Content-Type":"application/json"}});
const normalizePhone=(s:string)=>s.replace(/[\s()-]/g,"");
async function sha256(value:string){const bytes=new TextEncoder().encode(value);const digest=await crypto.subtle.digest("SHA-256",bytes);return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,"0")).join("")}
Deno.serve(async req=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
  if(req.method!=="POST")return json({error:"Method not allowed"},405);
  const url=Deno.env.get("SUPABASE_URL"),key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!url||!key)return json({error:"Server configuration missing"},500);
  let body:Record<string,unknown>;try{body=await req.json()}catch{return json({error:"Invalid JSON"},400)}
  const phone=typeof body.phone==="string"?normalizePhone(body.phone):"";
  const code=typeof body.activation_code==="string"?body.activation_code.trim():"";
  const fullName=typeof body.full_name==="string"?body.full_name.trim():"";
  const password=typeof body.password==="string"?body.password:"";
  if(!/^\+[1-9]\d{7,14}$/.test(phone))return json({error:"اكتب رقم الهاتف بصيغة دولية، مثل +963…"},400);
  if(code.length<6||code.length>80||!fullName||fullName.length>100||password.length<8||password.length>128)return json({error:"تحقق من الاسم ورمز التفعيل وكلمة المرور (8 أحرف على الأقل)."},400);
  const admin=createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
  // Throttle by phone before checking the code. Never log raw codes.
  const {data:allowed,error:limitError}=await admin.rpc("allow_activation_attempt",{p_phone:phone});
  if(limitError){console.error("activation limiter failed",limitError.message);return json({error:"تعذر التحقق من التفعيل مؤقتًا."},500)}
  if(allowed!==true)return json({error:"تجاوزت عدد المحاولات. انتظر 15 دقيقة ثم حاول مجددًا."},429);
  // The stored hash is compared server-side; the code is never returned to the client or logged.
  const codeHash=await sha256(code);
  const {data:consumed,error:consumeError}=await admin.rpc("consume_activation_code",{p_phone:phone,p_code_hash:codeHash});
  if(consumeError){console.error("consume_activation_code failed",consumeError.message);return json({error:"تعذر التحقق من رمز التفعيل. راجع إعدادات الخادم."},500)}
  const invite=Array.isArray(consumed)?consumed[0]:null;
  if(!invite)return json({error:"رمز التفعيل غير صحيح أو منتهي أو مستخدم سابقاً."},400);
  const {data:created,error:createError}=await admin.auth.admin.createUser({phone,password,phone_confirm:true,user_metadata:{full_name:fullName}});
  if(createError){console.error("createUser failed",createError.message);return json({error:"استهلك رمز التفعيل لكن تعذر إنشاء الحساب. تواصل مع الإدارة لإصدار رمز جديد."},500)}
  const role=invite.assigned_role;
  const status=role==="customer"?"active":"pending";
  const {error:profileError}=await admin.from("profiles").upsert({id:created.user.id,full_name:fullName,phone,role,status,available:false},{onConflict:"id"});
  if(profileError){console.error("profile upsert failed",profileError.message);await admin.auth.admin.deleteUser(created.user.id);return json({error:"تعذر تجهيز ملف الحساب. تواصل مع الإدارة لإعادة التفعيل."},500)}
  return json({ok:true,role,status,message:status==="pending"?"تم إنشاء الحساب؛ يحتاج موافقة الإدارة.":"تم إنشاء الحساب. سجّل الدخول بكلمة المرور الجديدة."},201);
});
