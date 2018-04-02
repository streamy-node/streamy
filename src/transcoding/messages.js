// var ERROR_CODES = {
//   "success":0,
//   "fileNotFound":404,
//   "unknown":-1000
// }
// Object.freeze(ERROR_CODES)
// const _ERROR_CODES = ERROR_CODES;
// export { _ERROR_CODES as ERROR_CODES };

class StatusMsg {
  constructor(progression,data){
    this.progression = progression;
    this.data = data;
  }
  
  getJson(){
    var status = {code:this.code, progression:this.progression, data:this.data};
    return JSON.stringify(status);
  }
}

class FinalMsg {
  constructor(code,msg,data){
    this.code = code;
    this.msg = msg;
    this.data = data;
  }
  
  getJson(){
    var status = {code:this.code, msg:this.progression, data:this.data};
    return JSON.stringify(status);
  }
}



const _StatusMsg = StatusMsg;
export { _StatusMsg as StatusMsg };
const _FinalMsg = FinalMsg;
export { _FinalMsg as FinalMsg };
