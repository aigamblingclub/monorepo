declare module 'js-sha256' {
    interface Sha256 {
        (data: string | Uint8Array): string;
        array(data: string | Uint8Array): number[];
        digest(data: string | Uint8Array): Uint8Array;
        hex(data: string | Uint8Array): string;
        base64(data: string | Uint8Array): string;
        create(): {
            update(data: string | Uint8Array): this;
            array(): number[];
            digest(): Uint8Array;
            hex(): string;
            base64(): string;
        };
    }

    const sha256: Sha256;
    export { sha256 };
} 