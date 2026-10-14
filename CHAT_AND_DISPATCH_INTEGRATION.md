# تعليمات ربط الواجهة الحالية بالميزات الجديدة

## إنشاء الطلب من واجهة الزبون
استخدم الدالة بدلاً من `insert` المباشر:
```js
const { data: rideId, error } = await supabase.rpc('create_ride_broadcast', {
  p_pickup: pickupText,
  p_dropoff: dropoffText,
  p_pickup_lat: pickupLat,
  p_pickup_lng: pickupLng,
  p_dropoff_lat: dropoffLat,
  p_dropoff_lng: dropoffLng,
  p_vehicle_type: selectedVehicle
});
```
تُرجع `rideId`. اقرأ سجل الرحلة من `rides` وراقب الحالة. لا تعتبر إرسال الطلب ناجحاً إذا كانت `error` موجودة.

## قبول الطلب من السائق أو المكتب
```js
const { data: won, error } = await supabase.rpc('accept_ride_broadcast', {
  p_ride_id: Number(rideId)
});
if (error) showError(error.message);
else if (won) showMessage('تم قبول الرحلة');
else showMessage('سبقك مستخدم آخر إلى قبول الرحلة');
```

## إرسال رسالة في المحادثة
```js
const { error } = await supabase.from('ride_messages').insert({
  ride_id: Number(rideId),
  sender_id: session.user.id,
  body: messageText.trim()
});
```
لتحميل الرسائل:
```js
const { data, error } = await supabase.from('ride_messages')
  .select('id,ride_id,sender_id,body,created_at')
  .eq('ride_id', Number(rideId))
  .order('created_at', { ascending: true });
```
Realtime:
```js
supabase.channel('ride-chat-' + rideId)
  .on('postgres_changes', {
    event: 'INSERT', schema: 'public', table: 'ride_messages',
    filter: 'ride_id=eq.' + rideId
  }, payload => appendMessage(payload.new))
  .subscribe();
```

## الخريطة
خزّن الإحداثيات في `pickup_lat`, `pickup_lng`, `dropoff_lat`, `dropoff_lng`. استخدم Leaflet مع OpenStreetMap، واطلب إذن الموقع عبر `navigator.geolocation` بعد ضغط المستخدم على زر واضح. لا تطلب الموقع دون موافقته.
