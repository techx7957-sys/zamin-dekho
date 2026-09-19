---
name: ZEGO SDK compatibility
description: Protocol and SDK constraints that must be preserved when changing ZEGO publishing or token code.
---

Use the installed ZEGO Express Web SDK signatures as the source of truth. In this project, video bitrate updates use `setVideoConfig(streamId, { maxBitrate })`, and Token04 generation must retain the ZEGO-required AES-256-CBC packet format.

**Why:** Replacing either with a guessed API or a different token cipher can make publishing or room authentication fail even when the surrounding lifecycle is correct.

**How to apply:** Inspect the bundled SDK before changing video publishing APIs, and treat security-scan warnings about the Token04 CBC mode as a protocol-compatibility exception unless ZEGO's token specification changes.