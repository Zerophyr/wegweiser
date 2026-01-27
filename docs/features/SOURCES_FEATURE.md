# Sources Display Feature

## Overview
Instead of listing every URL directly in the AI response text (which makes it harder to read), the extension now displays sources in a clean, organized way at the bottom of each answer.

## How It Works

### 1. Sources Indicator
When an AI response contains URLs, a compact indicator appears at the bottom showing:
- **Favicon Stack**: Up to 5 favicons from unique domains (overlapping style)
- **Source Count**: Total number of sources (e.g., "20 sources")
- **Interactive**: Clickable to view full source list

### 2. Sources Modal
Clicking the indicator opens a modal window that displays:
- Sources grouped by domain
- Domain favicon and name
- Count of sources per domain
- Individual clickable links to each source
- Clean, organized layout

## Technical Implementation

### Files Modified/Created

#### sources.js (NEW)
Contains all source extraction and display logic:

**Key Functions:**
- `extractSources(text)` - Extracts URLs from AI response text using regex
- `getFaviconUrl(url)` - Gets favicon from Google's favicon service
- `getUniqueDomains(sources)` - Groups sources by domain
- `createSourcesIndicator(sources, answerElement)` - Creates the bottom indicator
- `showSourcesModal(sources, uniqueDomains)` - Displays the modal popup

**Features:**
- URL deduplication
- Markdown link title extraction ([title](url) format)
- Fallback to domain name if no title found
- Favicon error handling with fallback icon
- Modal animations (fade-in, slide-up)
- Keyboard support (Escape to close)
- Click outside to close

#### sidepanel.js (MODIFIED)
Integration added after markdown rendering:

```javascript
// Extract and display sources
const sources = extractSources(fullAnswer);
if (sources.length > 0) {
  const sourcesIndicator = createSourcesIndicator(sources, answerItem);
  if (sourcesIndicator) {
    answerItem.appendChild(sourcesIndicator);
  }
}
```

#### sidepanel.html (MODIFIED)
Script tag added to load sources.js:
```html
<script src="sources.js"></script>
```

## User Experience

### Before
```
AI Response with lots of URLs:
https://example1.com/article
https://example2.com/page
https://example3.com/doc
... (cluttered text)
```

### After
```
AI Response (clean text)

[Favicon icons] 20 sources (clickable)
```

### Modal View
```
Sources (20)
×

example1.com (5)
  Article Title 1
  Article Title 2
  ...

example2.com (8)
  Page Title 1
  Page Title 2
  ...

example3.com (7)
  Doc Title 1
  Doc Title 2
  ...
```

## Styling

### Indicator
- Dark background with border
- Hover effect (lighter background, blue border)
- Favicon stack with overlapping effect (z-index)
- Modern, clean design matching extension theme

### Modal
- Full-screen overlay with semi-transparent background
- Centered modal with max-width 600px
- Scrollable content area
- Smooth animations
- Close button (×) in header
- Grouped by domain with favicons
- Clickable links with hover effects

## Security

- **URL Validation**: Only HTTPS URLs are processed
- **HTML Escaping**: All user-generated content is escaped
- **Favicon Service**: Uses Google's trusted favicon service
- **Error Handling**: Graceful fallbacks for missing favicons

## Performance

- **Efficient Regex**: Single pass to extract all URLs
- **Deduplication**: Set-based deduplication before processing
- **Lazy Modal**: Modal created only when clicked (not on page load)
- **Cleanup**: Modal removed from DOM when closed

## Browser Compatibility

- Chrome/Edge: Full support
- Firefox: Full support (if extension is ported)
- Safari: Full support (if extension is ported)

## Future Enhancements (Potential)

- Source preview on hover
- Copy all sources to clipboard
- Filter sources by domain
- Sort sources alphabetically or by relevance
- Archive/save sources for later
- Source validation (check if URL is still alive)

## Version

Feature added in: **v0.7.0**
