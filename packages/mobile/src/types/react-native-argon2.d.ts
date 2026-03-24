declare module "react-native-argon2" {
  interface Argon2Options {
    iterations?: number;
    memory?: number;
    parallelism?: number;
    hashLength?: number;
    mode?: "argon2i" | "argon2d" | "argon2id";
    saltEncoding?: "hex" | "utf8";
  }

  interface Argon2Result {
    rawHash: string;
    encodedHash: string;
  }

  export default function argon2(
    password: string,
    salt: string,
    options?: Argon2Options
  ): Promise<Argon2Result>;
}
