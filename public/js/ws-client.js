class BusTrackWS{
    constructor({role,busId = 'BUS-001',onMessage,onOpen,onClose}){
    this.role      = role;
    this.busId     = busId;
    this.onMessage = onMessage;
    this.onOpen    = onOpen;
    this.onClose   = onClose;
    this.ws        = null;
    this.reconnectDelay = 2000;
    this.reconnectTimer = null;
    this.intentionalClose = false;
    this.connect();
    }

    connect(){
        const proto = location.protocol === 'https:' ? 'wss' : 'ws';
        const url = `${proto}://${location.host}?role=${this.role}&busId=${this.busId}`;

        this.ws = new WebSocket(url);

        this.ws.onopen = () =>{
            console.log(`[WS] Connected as ${this.role}`);
            this.reconnectDelay = 2000;
            if(this.onOpen)this.onOpen();
        };

        this.ws.onmessage = (event)=>{
            try{
                const data = JSON.parse(event.data);
                if(this.onMessage)this.onMessage(data);
            }catch (e){ console.error('[WS Parse error]', e);}
        };

        this.ws.onclose =()=>{
            if(this.intentionalClose) return;
            console.log(`[WS] Disconnected - retrying is ${this.reconnectDelay}ms`);
            if(this.onClose)this.onClose();
            this.reconnectTimer = setTimeout(()=> this.connect(),this.reconnectDelay);
            this.reconnectDelay = Math.min(this.reconnectDelay * 1.5,15000);
        };
        this.ws.onerror = (e)=>{console.error('[WS] Error',e);};
    }
    send(data){
        if(this.ws && this.ws.readyState === WebSocket.OPEN){
            this.ws.send(JSON.stringify(data));
            return true;
        }
        return false;
    }
    close(){
         this.intentionalClose = true;
         clearTimeout(this.reconnectTimer);
         if(this.ws)this.ws.close();    
    }

    get connected() {
        return !!(this.ws && this.ws.readyState === WebSocket.OPEN);
    }
}