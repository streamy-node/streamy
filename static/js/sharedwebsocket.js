
class SharedWebSocket{
    constructor(){
        this.namespaces = {}
    }

    subscribe(namespace){
        if(namespace in this.namespaces){
            this.namespaces[namespace].refs++;
        }else{
            let ws = io.connect(namespace);
            this.namespaces[namespace] = {refs:1,ws:ws};
        }
        return this.namespaces[namespace].ws;
    }

    unsubscribe(namespace){
        if(namespace in this.namespaces){
            this.namespaces[namespace].refs--;
            if(this.namespaces[namespace].refs == 0){
                this.namespaces[namespace].ws.close(namespace)
                delete this.namespaces[namespace];
            }
        }else{
            console.warn("Cannot unsubscribe unknown socket")
        }
    }
}
var ws_worker = io.connect('/workers')