/**
 * ファイルの内容からフロントマターとコンテンツを分離する
 * フロントマターは '---' を含む形で抽出
 * フロントマターがない場合は空文字とコンテンツ全体を返す
 * frontmatter + content = 元のfileContentとなる
 * 
 * 例:
 * Input:
 * ---
 * title: Hello
 * date: 2024-01-01
 * ---
 * Content here...
 * 
 * Output:
 * {
 *   frontmatter: "---\ntitle: Hello\ndate: 2024-01-01\n---\n",
 *   content: "Content here..."
 * }
 */
export function parseFrontmatter(fileContent: string): { frontmatter: string, content: string } {
    // 最初の文字が'---'で始まらない場合は早期リターン
    if (!fileContent.startsWith('---\n')) {
        return {
            frontmatter: '',
            content: fileContent
        };
    }

    // 2つ目の'---'を探す
    const secondDelimiterIndex = fileContent.indexOf('\n---\n', 4);
    if (secondDelimiterIndex === -1) {
        return {
            frontmatter: '',
            content: fileContent
        };
    }

    return {
        frontmatter: fileContent.slice(0, secondDelimiterIndex + 5), // ---\nまで含める
        content: fileContent.slice(secondDelimiterIndex + 5)         // 残りの部分
    };
}