import './index.css';

document.addEventListener("DOMContentLoaded", ()=>{
    document.getElementById('btn-reload')?.addEventListener('click', ()=>{
        console.log('reload click', window.RPBridge?.query.rp_referrer)
        if(window.RPBridge?.query.rp_referrer){
            location.href = window.RPBridge?.query.rp_referrer;
        }
    })
});

window.RPBridge?.startup();