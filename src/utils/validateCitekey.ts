export function validateCitekey(citekey: string): boolean {
    // ファイル名が空文字列は無効
    if (!citekey) {
        console.warn('Simple Citations: skipped an item with an empty citekey.');
        return false;
    }

    // 使用できない特殊文字をチェック
    const invalidChars = /[#^[\]|\\/:]/;
    if (invalidChars.test(citekey)) {
        console.warn(`Simple Citations: skipped item with invalid citekey "${citekey}" (must not contain # ^ [ ] | \\ / :).`);
        return false;
    }

    return true;
}
