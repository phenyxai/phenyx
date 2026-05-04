# RAW Memories API - Beta Feature

## Overview
The RAW Memories feature allows developers to request access to users' LLM conversation data from platforms like ChatGPT, Claude, and other AI assistants. This provides rich contextual data about user preferences, communication patterns, and AI interaction history.

**Note**: Basic profile data (name, email, account details) is always included in all requests.

## Usage Modes

### Mode 1: RAW Data Only
Request only LLM conversation data + basic profile data. Shows only LLM connections (ChatGPT, Claude, Gemini, etc.) in the connection flow.

```javascript
<OnairosButton 
  requestData={['rawMemories']}  // LLM data + basic (always included)
  rawMemoriesOnly={true}         // Show only LLM connections
  webpageName="Your App"
  onComplete={handleRawMemories}
/>
```

### Mode 2: RAW Data + Normal Data Requests
Request LLM conversation data plus additional user insights (traits, sentiment analysis, preferences). Shows all connection options.

```javascript
<OnairosButton 
  requestData={['rawMemories', 'personality', 'preferences']}  // LLM + traits + preferences + basic
  rawMemoriesOnly={false}        // Show all data request options (default)
  rawMemoriesConfig={{
    platforms: ['chatgpt', 'claude', 'gemini'],  // Specific LLM platforms
    dateRange: {
      from: '2024-01-01',
      to: '2024-12-31'
    },
    includeMetadata: true,
    maxConversations: 100
  }}
  webpageName="Your App"
  onComplete={handleRawMemories}
/>
```

## Parameters

### `requestData` Array
- **`'rawMemories'`** - Include LLM conversation data in the request
- **`'personality'`** - Include AI-analyzed personality traits and behavioral patterns
- **`'preferences'`** - Include user preferences, interests, and settings
- **Basic data is always included** (name, email, profile information)

### `rawMemoriesOnly` Boolean
- **`true`** - Only show LLM data sources (ChatGPT, Claude, Gemini, Grok) on connections page
- **`false`** - Show all available data request options including social media platforms (default)

### `rawMemoriesConfig` Object (Optional)
```javascript
{
  platforms: string[],        // ['chatgpt', 'claude', 'gemini', 'perplexity']
  dateRange: {
    from: string,            // ISO date string
    to: string               // ISO date string
  },
  includeMetadata: boolean,  // Include conversation metadata
  maxConversations: number,  // Limit number of conversations
  minLength: number          // Minimum conversation length (messages)
}
```

## Response Format

### Success Response
```javascript
{
  success: true,
  data: {
    basic: {
      name: string,
      email: string,
      profileInfo: object
    },
    rawMemories: {
      conversations: Conversation[],
      metadata: {
        totalConversations: number,
        platforms: string[],
        dateRange: {
          earliest: string,
          latest: string
        },
        processingInfo: {
          filtered: number,
          included: number,
          totalMessages: number
        }
      }
    },
    // Additional data types if requested (personality, preferences)
    personality?: object,
    preferences?: object
  }
}
```

### Error Response
```javascript
{
  success: false,
  error: string,
  code: 'NO_LLM_DATA' | 'INSUFFICIENT_PERMISSIONS' | 'PROCESSING_ERROR'
}
```

## Conversation Data Structure

Based on ChatGPT conversation format, adapted for cross-platform compatibility:

### Root Structure
```javascript
[
  {
    id: string,              // Unique conversation UUID
    title: string,           // Conversation title
    created: number,         // Unix timestamp
    model: string,           // AI model used (e.g., "gpt-4", "claude-3")
    platform: string,        // Platform: "chatgpt" | "claude" | "gemini" | "perplexity"
    messages: Message[]      // Array of all messages in conversation
  }
]
```

### Message Structure
```javascript
{
  role: string,              // "user" | "assistant" | "system" | "tool"
  time: number | null,       // Unix timestamp
  text: string,              // Message content
  meta: MessageMeta          // Platform-specific metadata
}
```

### Message Metadata by Type

#### User Messages
```javascript
{
  request_id?: string,                    // Unique request identifier
  user_context_message_data?: object,    // Custom instructions
  about_user_message?: string,           // User preferences/personality
  about_model_message?: string,          // Model behavior instructions
  developer_mode_connector_ids?: string[], // Connected tools/extensions
  selected_sources?: object[],           // Information sources array
  selected_github_repos?: object[],      // GitHub repositories array
  message_source?: string                // Origin of message
}
```

#### Assistant Messages
```javascript
{
  model_slug?: string,                   // Model used for response
  citations?: object[],                  // Array of citations
  content_references?: object[],         // Array of content references
  finish_details?: {
    type: string,                        // Completion type (e.g., "stop")
    reasoning_status?: string            // For thinking models
  },
  finished_duration_sec?: number,       // Reasoning duration
  parent_id?: string                     // Parent message ID for threading
}
```

#### System Messages
```javascript
{
  is_visually_hidden_from_conversation?: boolean,
  is_contextual_answers_system_message?: boolean,
  contextual_answers_message_type?: string,
  is_complete?: boolean,
  rebase_developer_message?: boolean
}
```

#### Tool/Search Results
```javascript
{
  search_result_groups?: {
    domain: string,
    entries: {
      url: string,
      title: string,
      snippet: string,
      ref_id: {
        turn_index: number,
        ref_type: string,
        ref_index: number
      },
      pub_date: number | null,
      attribution: string
    }[]
  }[],
  search_turns_count?: number,
  search_source?: string,
  sonic_classification_result?: {
    latency_ms: number,
    search_prob: number,
    complex_search_prob: number,
    classifier_config_name: string,
    search_complexity: string
  }
}
```

## Platform Support

### Currently Supported
- **ChatGPT** - Full conversation history with metadata, memories, ChatGPT apps and more data 
- **Claude** - Conversation history (limited metadata)
- **Gemini** - Basic conversation history
- **Grok** - Conversation data

### Coming Soon
- **Perplexity** - Search-enhanced conversations
- **Character.AI** - Character interaction history
- **Poe** - Multi-model conversation history

## Privacy & Security

**HIPPA COMPLIANCE** - Via Delve eta early week of 27th


### Data Processing
- All conversation data is processed locally when possible
- Sensitive information is automatically filtered
- Users have full control over what data is shared

### Consent Flow
1. User sees clear explanation of what LLM data will be accessed
2. Platform-by-platform consent (users can select specific platforms)
3. Date range selection for historical data
4. Real-time preview of data being shared

### Data Retention
- Raw conversation data is not stored by Onairos
- Only processed insights and preferences are retained
- Users can request data deletion at any time

## Example Implementation

```javascript
import { OnairosButton } from 'onairos-sdk';

function MyApp() {
  const handleRawMemories = (response) => {
    if (response.success) {
      const { conversations, metadata } = response.data.rawMemories;
      
      console.log(`Received ${conversations.length} conversations`);
      console.log(`From platforms: ${metadata.platforms.join(', ')}`);
      console.log(`Total messages: ${metadata.processingInfo.totalMessages}`);
      
      // Process conversation data
      conversations.forEach(conv => {
        console.log(`Conversation: ${conv.title}`);
        console.log(`Platform: ${conv.platform}`);
        console.log(`Messages: ${conv.messages.length}`);
        
        // Analyze user patterns
        const userMessages = conv.messages.filter(m => m.role === 'user');
        const topics = extractTopics(userMessages);
        
        // Use conversation insights
        updateUserProfile(topics, conv.platform);
      });
    }
  };

  return (
    <OnairosButton 
      requestData={['rawMemories']}  // Gets LLM data + basic profile (always included)
      rawMemoriesOnly={true}         // Shows only LLM connections in UI
      rawMemoriesConfig={{
        platforms: ['chatgpt', 'claude'],
        includeMetadata: true,
        maxConversations: 50
      }}
      webpageName="AI Conversation Analyzer"
      onComplete={handleRawMemories}
    />
  );
}
```

## Beta Limitations

- Maximum 100 conversations per request
- Processing time may be longer for large datasets
- Some metadata fields may not be available for all platforms
- Rate limiting applies to prevent abuse

## Feedback

This is a beta feature. Please report issues or feature requests to:
- GitHub Issues: [onairos/sdk/issues](https://github.com/onairos/sdk/issues)
- Email: beta-feedback@onairos.com
- Discord: [Onairos Community](https://discord.gg/onairos)
