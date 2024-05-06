# Simple Citations

This is an Obsidian plugin compatible with the [Citations plugin](https://github.com/hans/obsidian-citation-plugin). It enables the importation of literature notes from Zotero. The main feature of this plugin is **its simple usage**; it requires **minimal setup time** and allows you to **add or update literature notes in one go**.

# Installation & Settings

Install via [BRAT](https://github.com/TfTHacker/obsidian42-brat). Configure the path for the `Better-CSL-JSON` file and the literature notes folder in your vault.

# Usage 

- Use the "Add command" to import all literature notes that are not yet in the vault.
- Use the "Update command" to only update the frontmatter as described below.
- The "Modified export (docx)" command executes the "Export as Word Document (docx)" command from the [Pandoc Plugin](https://github.com/OliverBalfour/obsidian-pandoc).
    - Before execution, it converts links to literature notes into Pandoc's format and **retains them for only five seconds**.
 
```
[[@citation-key]] → [@citation-key]
[[@citation-key|description]] → [@citation-key] // aliases OK
[[@citation-key]][[@citation-key]] → [@citation-key;@citation-key] // multiple citations OK
[[@citation-key]]   [[@citation-key]] → [@citation-key;@citation-key] // You can insert spaces or line breaks between  the links.
```

# Template

Metadata for each piece of literature is appended to the frontmatter of each note. You cannot customize the template.

- aliases:
    - Title
    - First Author. Journal. Year
- title: Title
- authors: List of authors
- journal: Journal 
- year: Publush year
- doi: DOI link
- zotero: Zotero URI
