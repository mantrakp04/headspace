# Spotify queues and Headspace

Reviewed against Spotify's public documentation on September 8, 2026.

## Playback behavior

| Action | Spotify behavior and Headspace implementation |
| --- | --- |
| Play a song in an album or playlist | Keep the collection as the playback context and start at that entry. Spotify supplies the rest, including entries beyond the loaded page. Headspace sends `context_uri` and the original zero-based position. |
| Play the whole collection | Send the album, playlist, or artist context without a track offset. A podcast show uses its episode list because the public playback endpoint does not document show contexts. |
| Play Liked Songs | Headspace resolves remaining saved-song pages and submits the list with the clicked position. It no longer submits one URI or truncates the source to a 100-song window. Large libraries can take longer to prepare and remain subject to Spotify API limits. |
| Play from search or recent listening | Headspace plays the displayed result set from the selected entry. This is an explicit Headspace choice: Spotify does not expose its search-to-radio behavior as a public command. Search pagination remains a browsing action rather than fetching potentially thousands of unrelated matches when Play is clicked. |
| Queue a song | Add it to Spotify's explicit queue, preserving the current source. Spotify owns the order and continuation. The native app targets its own device so an addition cannot silently land on another active player. |
| Pause, resume, next, previous | Use transport commands without submitting a new source. Headspace does not run a timer that starts each next song, so natural transitions stay with Spotify. |
| Shuffle | Toggle Spotify's shuffle state. Off keeps source order; on lets Spotify shuffle. Do not randomly sort the local view or shuffle manually queued entries in application code. |
| Repeat | Cycle off → collection → one song → off. Preserve the SDK's three distinct states in the UI. A one-song source with repeat-all was previously capable of repeatedly playing only that song. |
| Autoplay | Spotify can supply similar music after the source ends. Its setting belongs to Spotify; ordinary source continuation does not require recommendations. Headspace neither fabricates recommendations nor forces a playback restart at the end. Actual availability depends on Spotify and its device/account settings. |
| Open the queue | Show the currently playing item separately from upcoming entries. Refresh on SDK changes, while the panel is open, and when returning to the app. Display a loading/error state rather than falsely reporting an empty queue. |
| Browse while music plays | Browsing must not replace playback. The native row's source is captured with the loaded results, rather than inferred from whichever navigation tab is currently selected. |

## Where Spotify's own UI goes further

Spotify separates manually added songs from source continuation, lets listeners move/remove entries and clear manual additions, and supports Smart Shuffle recommendations. Autoplay, Smart Shuffle, and ordinary shuffle are different features.

The documented Web API exposes queue reading and appending, but does not expose queue removal, reordering, clearing, explicit/source provenance, Autoplay configuration, or Smart Shuffle configuration. The queue response is a flat list, so Headspace labels it “Next up” instead of guessing which entries were manually queued. Repeated URIs are preserved because a playlist or manual queue can legitimately contain the same song more than once.

“Edit in Spotify” opens Spotify's queue for edits unavailable in the public API. Replacing the entire playback context to imitate a queue edit would lose the original context and could disrupt shuffle, history, recommendations, and entries added from another device.

## Defects repaired

- Native non-collection rows submitted only the selected URI.
- The collection Play button passed an album/playlist URI to a command that accepted only tracks and episodes.
- The web prototype's title and row-play buttons disagreed about whether to preserve album/playlist context.
- A URI-only offset selected the first occurrence when a playlist contained a song twice.
- Filtering missing playlist entries and pagination could shift the selected index.
- The web prototype discarded tracks outside an arbitrary 100-song window.
- Native repeat collapsed repeat-all and repeat-one into a boolean.
- The queue was fetched only when opened and shared its loading flag with the library.
- Native queue additions targeted whichever device was active instead of Headspace.

## Verification

The regression suite covers the shared selection resolver and native playback adapter with Spotify HTTP/SDK fixtures. It checks context requests, collection Play, duplicate occurrences, unavailable items, pagination past 100 tracks, search/podcast lists, transport preservation, targeted queue additions, repeat cycling, shuffle state, and SDK notifications. Live playback must be checked separately from these fixtures.

The installed native app was also checked with its existing Spotify session. A selected search result had subsequent results in the queue. At its natural end, the next song started without a transport command, and the open queue moved the new song into Now playing automatically. A song selected partway through Liked Songs also started successfully after loading the remaining saved-song pages. The attempted live playlist check was interrupted by concurrent user interaction; album/playlist request semantics are covered by the automated tests. Recommendation behavior at the end of the entire source and very large libraries remain separate live checks.

## Sources

- [Spotify Play Queue](https://support.spotify.com/us/article/play-queue/): queue access, additions, reordering, removal, and clearing.
- [Spotify shuffle](https://support.spotify.com/us/article/shuffle-play/): ordinary shuffle and Smart Shuffle.
- [Spotify Autoplay](https://support.spotify.com/us/article/autoplay/): recommendations after an album, playlist, or selection ends.
- [Start/Resume Playback](https://developer.spotify.com/documentation/web-api/reference/start-a-users-playback): context, URI lists, offsets, and device targeting.
- [Get the User's Queue](https://developer.spotify.com/documentation/web-api/reference/get-queue): currently playing item and upcoming entries.
- [Add Item to Playback Queue](https://developer.spotify.com/documentation/web-api/reference/add-to-queue): append and device targeting.
- [Set Repeat Mode](https://developer.spotify.com/documentation/web-api/reference/set-repeat-mode-on-users-playback): off, context, and track.
- [Web Playback SDK](https://developer.spotify.com/documentation/web-playback-sdk/reference): player state and transport events.
