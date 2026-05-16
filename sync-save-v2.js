window.addEventListener('load',function(){
  var KEY='jjrifas_v6_final_00_99';

  function getItems(){
    try{
      return JSON.parse(localStorage.getItem(KEY)||'[]')||[];
    }catch(e){
      return[];
    }
  }

  function postItems(){
    var xhr=new XMLHttpRequest();
    xhr.open('PUT','/api/reservations',true);
    xhr.setRequestHeader('Content-Type','application/json');
    xhr.send(JSON.stringify({reservations:getItems()}));
  }

  var form=document.getElementById('reservationForm');
  if(form){
    form.addEventListener('submit',function(){
      setTimeout(postItems,2500);
    });
  }

  var admin=document.getElementById('adminPanel');
  if(admin){
    admin.addEventListener('click',function(){
      setTimeout(postItems,1200);
    });
  }

  window.syncReservationsNow=postItems;
});
