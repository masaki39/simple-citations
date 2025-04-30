export function validateCitekey(citekey: string): boolean {
    // ファイル名が空文字列は無効
    if (!citekey) {
        console.log(`Skip item with empty citekey`);
        return false;
    }

    // 使用できない特殊文字をチェック
    const invalidChars = /[#\^[\]|\\/:]/;
    if (invalidChars.test(citekey)) {
        console.log(`Skip item with invalid citekey: ${citekey}\ncitekey must not contain #, ^, [, ], |, \\, /, :`);
        return false;
    }

    return true;
}
