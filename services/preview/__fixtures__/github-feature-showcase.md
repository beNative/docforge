# GitHub Feature Showcase

This document stress tests key GitHub Flavored Markdown rendering features.

---

## Mixed Content

Paragraph with `inline code`, **bold text**, _italic text_, ~~strikethrough~~, and a [link](https://example.com).

- [x] Completed task item
- [ ] Pending task item
- Regular list item
  - Nested bullet with `code` and **bold**

> Blockquote with **formatting** and `inline code`.
>
> Second quote line with [link](https://github.com).

1. Ordered first
2. Ordered second
3. Ordered third with `code`

---

## Tables

| Column | Alignment | Description |
| :----- | :-------: | ----------: |
| Left   |  Center   |           1 |
| Middle |  Center   |          22 |
| Right  |  Center   |         333 |

| Feature | Example |
| ------- | ------- |
| Inline `code` | Works |
| Bold **text** | Styled |

---

## Code Blocks

```ts
export interface User {
  id: number;
  name: string;
}

export const demo = (user: User) => {
  console.log(`Hello ${user.name}`);
};
```

```python
def greet(name):
    print(f"Hello, {name}!")
```

```
Plain fenced block without language.
Multiple lines preserved.
```

---

## Definition Lists

Term 1
: Definition with `inline` code

Term 2
: Additional definition with **bold** text

---

## Table Alignment Verification

| Syntax | Description |
| ------ | ----------- |
| Header | Title |
| Paragraph | Text |

---

## Final Notes

Text after multiple sections to confirm consistent spacing and divider handling.
