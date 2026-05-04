# Onairos Connectors Reference

## Available Connectors

| Connector | Type | ID | Description |
|-----------|------|-----|-------------|
| **ChatGPT** | LLM | `chatgpt` | OpenAI ChatGPT conversations |
| **Claude** | LLM | `claude` | Anthropic Claude conversations |
| **Gemini** | LLM | `gemini` | Google Gemini conversations |
| **Grok** | LLM | `grok` | X/Twitter Grok conversations |
| **YouTube** | OAuth | `youtube` | Watch history & subscriptions |
| **Gmail** | OAuth | `gmail` | Email metadata & patterns |
| **LinkedIn** | OAuth | `linkedin` | Professional profile & connections |
| **Pinterest** | OAuth | `pinterest` | Pins & boards |
| **Reddit** | OAuth | `reddit` | Posts, comments & subscriptions |
| **Instagram** | Data | `instagram-data` | Profile & interactions |
| **X (Twitter)** | OAuth | `x` | Posts & interactions |

---

## Quick Start

### Show All Connectors (Default)
```jsx
<OnairosButton webpageName="MyApp" />
```

### Show Only LLM Connectors
```jsx
<OnairosButton 
  webpageName="MyApp"
  rawMemoriesOnly={true}
/>
// Shows: ChatGPT, Claude, Gemini, Grok
```

### Show Specific Connectors
```jsx
<OnairosButton 
  webpageName="MyApp"
  allowedPlatforms={['ChatGPT', 'YouTube', 'Gmail']}
/>
// Shows only: ChatGPT, YouTube, Gmail
```

### Prioritize a Connector
```jsx
<OnairosButton 
  webpageName="MyApp"
  priorityPlatform="gmail"
/>
// Shows all, but Gmail is highlighted first
```

---

## Props Reference

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `allowedPlatforms` | `string[]` | `null` | List of connector names/IDs to show. `null` = all |
| `rawMemoriesOnly` | `boolean` | `false` | Show only LLM connectors |
| `priorityPlatform` | `string` | `null` | Connector to highlight/prioritize |

---

## Examples

### Social Media App
```jsx
<OnairosButton 
  webpageName="SocialApp"
  allowedPlatforms={['Instagram', 'YouTube', 'X']}
/>
```

### AI/Chat App
```jsx
<OnairosButton 
  webpageName="AIApp"
  rawMemoriesOnly={true}
/>
```

### Professional App
```jsx
<OnairosButton 
  webpageName="ProApp"
  allowedPlatforms={['LinkedIn', 'Gmail']}
  priorityPlatform="linkedin"
/>
```

### Shopping/Lifestyle App
```jsx
<OnairosButton 
  webpageName="LifestyleApp"
  allowedPlatforms={['Pinterest', 'Instagram', 'YouTube']}
/>
```

---

## Connector IDs (for allowedPlatforms)

Use any of these values in the `allowedPlatforms` array:

```
chatgpt, claude, gemini, grok,
youtube, gmail, linkedin, pinterest, 
reddit, instagram, x
```

**Note:** Both the display name (`ChatGPT`) and connector ID (`chatgpt`) work.

---

## Need Help?

- Documentation: https://docs.onairos.uk
- Support: support@onairos.uk

