declare interface Window {
  RPBridge?: RPBridge;
}

interface LoadContentOptions {
  referrer?: string;
  [k:string]: string|number|boolean;
}