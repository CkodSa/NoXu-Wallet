export type MessageType =
  | "CREATE_WALLET"
  | "IMPORT_WALLET"
  | "UNLOCK"
  | "LOCK"
  | "GET_STATE"
  | "GET_BALANCE"
  | "SEND_TX"
  | "GET_HISTORY"
  | "EXPORT_SEED"
  | "CONNECT_REQUEST"
  | "DISCONNECT_REQUEST"
  | "APPROVE_ORIGIN"
  | "REVOKE_ORIGIN"
  | "GET_APPROVED_ORIGINS"
  | "SIGN_TX"
  | "SIGN_AND_SEND"
  | "SWITCH_NETWORK"
  | "SET_CUSTOM_RPC"
  | "GET_CUSTOM_RPC"
  | "GET_AUTO_LOCK"
  | "SET_AUTO_LOCK";

export type RpcMessage<T = any> = {
  type: MessageType;
  payload?: T;
};
