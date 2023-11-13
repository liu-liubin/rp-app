import './index.css';

document.addEventListener("DOMContentLoaded", ()=>{
    document.getElementById('btn-reload')?.addEventListener('click', ()=>{
        console.log('reload click', window.MRPBridge?.query.__rp_referrer)
        if(window.MRPBridge?.query.__rp_referrer){
            location.href = window.MRPBridge?.query.__rp_referrer;
        }
    })
});
