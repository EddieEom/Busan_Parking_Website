// 사용자 좌표는 브라우저 메모리에만 보관합니다. 네트워크·저장소로 전송하지 않습니다.
const numeric=value=>value!==null && value!==undefined && typeof value!=='boolean' && String(value).trim()!=='' && Number.isFinite(Number(value))?Number(value):null;
export function parkingCoordinates(parking) {
  const basic=parking.raw?.basic;
  let lat=numeric(parking.latitude ?? basic?.xCdnt),lon=numeric(parking.longitude ?? basic?.yCdnt);
  if(lat===null||lon===null)return null;
  if(Math.abs(lat)>90 && Math.abs(lat)<=180 && Math.abs(lon)<=90)[lat,lon]=[lon,lat];
  if(Math.abs(lat)>90||Math.abs(lon)>180||(lat===0&&lon===0))return null;
  return {latitude:lat,longitude:lon};
}
export function distanceKm(a,b) {
  const rad=x=>x*Math.PI/180;
  const dlat=rad(b.latitude-a.latitude),dlon=rad(b.longitude-a.longitude);
  const h=Math.sin(dlat/2)**2+Math.cos(rad(a.latitude))*Math.cos(rad(b.latitude))*Math.sin(dlon/2)**2;
  return 6371*2*Math.atan2(Math.sqrt(Math.min(1,h)),Math.sqrt(Math.max(0,1-h)));
}
export function nearbyParkings(items,position) {
  return items.flatMap(p=>{
    const coords=parkingCoordinates(p);
    return coords?[{...p,distanceKm:distanceKm(position,coords)}]:[];
  }).sort((a,b)=>a.distanceKm-b.distanceKm||a.name.localeCompare(b.name,'ko')).slice(0,5);
}
export const formatDistance=km=>km<1?`약 ${Math.round(km*1000)}m`:`약 ${km.toFixed(1)}km`;
export function locationError(error) {
  return ({1:'위치 권한이 거부되었습니다. 브라우저 또는 앱 설정에서 위치 권한을 허용해 주세요.',
    2:'현재 위치를 확인할 수 없습니다. 기기의 위치 기능(GPS)이 켜져 있는지 확인해 주세요.',
    3:'12초 안에 위치를 확인하지 못했습니다. 잠시 후 GPS 버튼을 다시 눌러 주세요.'})[error?.code]||error?.message||'현재 위치를 확인하지 못했습니다.';
}
export function getCurrentLocation(geolocation=globalThis.navigator?.geolocation) {
  return new Promise((resolve,reject)=>{
    if(!geolocation){reject(new Error('이 브라우저에서는 위치 기능을 사용할 수 없습니다.'));return;}
    geolocation.getCurrentPosition(position=>{
      const {latitude,longitude}=position.coords;
      if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||Math.abs(latitude)>90||Math.abs(longitude)>180){reject(new Error('현재 위치 좌표를 확인하지 못했습니다.'));return;}
      resolve({latitude,longitude});
    },reject,{enableHighAccuracy:true,timeout:12000,maximumAge:60000});
  });
}
