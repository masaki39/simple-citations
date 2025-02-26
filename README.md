# Simple Citations

This is an Obsidian plugin compatible with the [Citations plugin](https://github.com/hans/obsidian-citation-plugin). It enables the importation of literature notes from Zotero. The main feature of this plugin is **its simple usage**; it requires **minimal setup time** and allows you to **add or update literature notes in one go**.

## Installation & Settings

Enable the Obsidian community plugin, then install and activate it. After that, configure the paths for the `Better-CSL-JSON` file and the literature notes folder in your vault.

## Usage 

- Use the "Add command" to import all literature notes that are not yet in the vault.
- Use the "Update command" to update the notes as described below.
- The "Modified export (docx)" command executes the "Export as Word Document (docx)" command from the [Pandoc Plugin](https://github.com/OliverBalfour/obsidian-pandoc).
    - Before execution, it converts links to literature notes into Pandoc's format and **retains them for only five seconds**.
    - This enables you to create a bibliography.
- The "Copy missing note links" command is useful for identifying and copying links to literature notes that are not included in the JSON file.

## Frontmatter Template

Metadata for each piece of literature is appended to the frontmatter of each note.

- **aliases**:
    - First Author. Journal. Year
    - Title
- **title**: Title
- **authors**: List of authors
- **journal**: Journal 
- **year**: Publish year
- **doi**: DOI link
- **zotero**: Zotero URI

## Tag Option

If you enable the option to create tags, the following tags will be generated:
- `author/${firstAuthor}`
- `journal/${journalName}`

If you set this option to false and execute the "Update" command, the tags will be removed.

## Template Option

You can set a template file. The content will replace the block defined by:

`<!-- START_TEMPLATE -->`
`<!-- END_TEMPLATE -->`

If a template is set but the block is not present in the note, it will be appended to the bottom of the note. If you set no template file and execute the "Update" command, the template will be removed from notes.

## Abstract Option

You can define an abstract section in your notes using:

`<!-- START_ABSTRACT -->`
`<!-- END_ABSTRACT -->`

This section is processed after the template is applied, allowing you to include the abstract tag in your template similarly to how you would use the template option.

## Link Formatting 

The link format is only `[[@citation-key]]`, and it is converted when executing the "Modified export (docx)" command.

The plugin modifies the link format as follows:
- `[[citation-key]]` → `[@citation-key]`
- `[[citation-key|description]]` → `[@citation-key]` // aliases are allowed
- `[[citation-key]][[citation-key]]` → `[@citation-key;@citation-key]` // multiple citations are allowed
- `[[citation-key]]   [[citation-key]]` → `[@citation-key;@citation-key]` // spaces or line breaks can be inserted between links
- End of a sentence: `[[citation-key]]` → end of a sentence `[@citation-key]` // inserts links before `.` if there is nothing between them.
