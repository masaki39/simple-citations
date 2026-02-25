export function convertToPandocFormat(content: string): string {
    let result = content.replace(/\[\[(.*?)\|.*?\]\]/g, "[[$1]]"); // fix aliases
    result = result.replace(/\[\[@(.*?)\]\]/g, "[@$1]");           // convert to pandoc style
    result = result.replace(/\](\s*?)\[@/g, ";@");                  // connect citations
    result = result.replace(/(\.)\s*?(\[@.*?\])/g, " $2$1 ");       // insert before period
    return result;
}
