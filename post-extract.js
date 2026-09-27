// A set of reusable function for making it easier to read forum threads and
// to extract their content for use in data analysis or other processing.
// These functions capture the essence of these two tasks, and have been
// iterated on for about a decade to distil what it means to merge a thread or
// to extract a *conversation*. As such these should save time on pretty much
// any site where these features are desired (are to be added)

// Reuse any "button container" that might have been previously created.
// Allows for other features / buttons to be added to the same "control
// bar", grouping them nicely together without having to think about where
// to place the controls for each widget. Just plop them into the
// "uictrls" container and they'll be added left to right in the add order
// used.
function getOrCreateControls() {
    const CONTROLS_ID = 'uictrls';
    let container = document.getElementById(CONTROLS_ID);
    if (container) return container;

    container = document.createElement('div');
    container.id = CONTROLS_ID;

    document.body.appendChild(container);
    return container;
}

// the look and feel for the UI controls. Feel free to
// change or override it with a superseeding style sheet if desired.
function injectStyles() {
    const ID = 'uictrls-style';
    if (document.getElementById(ID)) return;
    const style = document.createElement('style');
    style.id = ID;
    style.textContent = `
        #uictrls {
            position: fixed; top: 8px; right: 8px; z-index: 99999;
            background: #111; border: 1px solid #e87a1a; border-radius: 8px;
            padding: 6px 10px; display: flex; gap: 8px; align-items: center;
            font-family: 'Segoe UI', system-ui, sans-serif; font-size: 13px;
        }
        #uictrls button {
            background: #1a1a1a; color: #e87a1a; border: 1px solid #e87a1a;
            border-radius: 12px; padding: 4px 12px; cursor: pointer;
            font-family: inherit; font-size: inherit;
        }
        #uictrls button:hover { background: #e87a1a; color: #111; }
        #thread-data {
            position: fixed; top: 0; left: 0; z-index: 999999;
            background: #111; color: #eee; white-space: pre;
            font-family: monospace; font-size: 15px;
            padding: 4px; width: 100%; height: 50%;
            border-bottom: 2px solid #e87a1a;
        }
    `;
    document.head.appendChild(style);
}

// Function for transforming web site conversations on discussion formus like
// bb, reddit, ... into JSON, for external data analysis or processing. A
// convenience function to DRY up this common need (task)
//
// To skip certain messages from being included, add a "xhide" class to them.
// Or provide a custom "isVisible" function. The default is to skip any
// message with an "xhide" class assigned.
//
// Usage example for reddit
//  addJsonExtractor({
//      getMessages: () => $c('.commentarea > div > div > .entry'),
//      getChildren: (el) => $c('.child > div > div > .entry', el.parentElement)
//          .filter(c => !c.parentElement.classList.contains('morechildren')),
//      getMessageId: (el) => el.parentElement.id.split('_').pop(),
//      isVisible: (el) => !el.classList.contains('xhide'),
//      fields: {
//          author: (el) => el.querySelector('.author')?.innerText?.trim(),
//          posted: (el) => el.querySelector('time')?.getAttribute('datetime')?.split('+')[0],
//          votes:  (el) => +(el.querySelector('.score.unvoted[title]')?.title || 0),
//          body:   '.usertext-body'
//      }
//  });
//
//  This creates a text area overlayh with the content of the serialized array
//  of messages, for easy copying. The overlay can be removed by pressing the
//  Escape key.
//
//  Example of data extracted from the above example:
// [{"author":"user1","posted":"2025-11-12T20:37:31","votes":20,"body":"bla-bla","id":"foo-bar","parentid":"root"},
//  {"author":"user2","posted":"2025-11-12T20:44:34","votes":12,"body":"something","id":"abc123","parentid":"foo-bar"},
//   ...]
//
// And an example for BB-code sites:
//  addJsonExtractor({
//     getMessages: () => $c('.js-replyNewMessageContainer > article'),
//     getMessageId: (el) => el.id.replace('js-',''),
//     fields: {
//         author: (el) => el.getAttribute('data-author'),
//         posted: (el) => el.querySelector('time')?.getAttribute('datetime')?.split('+')[0],
//         votes:  (el) => el.querySelectorAll('.reactionsBar-link > bdi').length,
//         body: (el) => {
//             const clone = el.querySelector('.js-messageContent article > div > .bbWrapper').cloneNode(true);
//             clone.querySelectorAll('blockquote').forEach(e => e.remove());
//             return clone.textContent.trim();
//         }
//     }
//  });
//
// For user scripts, just include it in the front matter (metadata comments)
// and call the function as illustrated above for any new site this feature
// should be added to.
//
function addJsonExtractor({
    getMessages,
    getChildren,
    getMessageId,
    fields,
    isVisible
}) {
    // Generic field extractor, extracting the values for the attribute
    // defined by the user-provided "fields" argument provided when the
    // function was called.
    function extractFields(el) {
        const result = {};
        for (const [key, extractor] of Object.entries(fields)) {
            result[key] = typeof extractor === 'function'
                ? extractor(el)
                : el.querySelector(extractor)?.textContent?.trim() ?? null;
        }
        return result;
    }

    // for sites that nest comments in the DOM, for which a getChildren
    // selector has to be provided in the main function call. without that
    // function this won't be doing any recrursive DOM walk. I.e. for flat
    // conversation struvtures, justdon't provide the getChildren callback.
    function recurse(el, parentId, posts, seen) {
        const id = getMessageId(el);
        if (seen.has(id)) return;
        seen.add(id);
        if (isVisible && !isVisible(el)) return;

        const data = extractFields(el);
        if (data === null) return;
        data.id = id;
        data.parentid = parentId;
        posts.push(data);

        if (getChildren) {
            getChildren(el).forEach(c => recurse(c, id, posts, seen));
        }
    }

    function extract() {
        const posts = [];
        const seen = new Set();
        getMessages().forEach(el => recurse(el, 'root', posts, seen));
        return posts;
    }

    // show the text area overlay
    function renderResult(posts) {
        const remove = () => document.querySelectorAll('#thread-data').forEach(e => e.remove());
        remove();
        const ta = document.createElement('textarea');
        ta.id = 'thread-data';
        ta.value = "[" + posts.map(p => JSON.stringify(p)).join(",\n") + "]";
        document.body.append(ta);
        document.body.addEventListener('keydown', function onkey(evt) {
            if (evt.key === 'Escape') {
                document.body.removeEventListener('keydown', onkey);
                remove();
            }
        });
    }

    function createUI() {
        const container = getOrCreateControls();
        const btn = document.createElement('button');
        btn.textContent = 'Extract';
        btn.title = 'Extract thread as JSON data';
        btn.addEventListener('click', () => renderResult(extract()));
        container.appendChild(btn);
    }

    injectStyles();
    createUI();
    console.log("[*] Thread JSON extractor initialized");
}


// Concatinate paginated thread pages into the currently shown in the browser,
// so the entire thread can be read and searched without tedious clicking.
//
// If using the extract json feature, the `getMessages` is the typically the same
// but not always (e.g for heavy JS sites that transmute the HTML data before rendering),
// so getMessages should typically be the same for these two functions except there's an
// explicit reason to use different functions.
function addFetchAllButton({getMessages, postsContainerEl, findNextPageUrl}) {
    async function appendAllPages(updateProgress, onDone) {
      const fetchDocument = url => fetch(url).then(res => res.text()).then(html => new DOMParser().parseFromString(html, "text/html"));

      let seen = new Set();
      let url = findNextPageUrl(document);
      while (url && !seen.has(url)) {
        seen.add(url);
        let doc = await fetchDocument(url);
        getMessages(doc).forEach(el => postsContainerEl.appendChild(el));
        url = findNextPageUrl(doc);
        updateProgress(seen.size);
      }
      onDone();
    }

    function createUI() {
        const container = getOrCreateControls();
        const btn = document.createElement('button');
        btn.textContent = 'Fetch all';
        btn.title = 'Fetches all posts spread out over paginated pages and merges them into the current list of posts';
        btn.addEventListener('click', () => { 
            btn.disabled = true;
            appendAllPages(
                (pageNo) => {btn.innerHTML = '' + pageNo;},
                () => btn.remove(),
            );
        });
        container.appendChild(btn);
    }

    injectStyles();
    createUI();
    console.log("[*] Fetch paginated pages initialized.");
}

// JQ-like element selector, to make navigating the dom less verbose.
// Esp convenient for defining the extractor functions like in the example.
function $c(expr, root){ return Array.from((root || document).querySelectorAll(expr)) };


// Complete example:
//
// (function() {
//     'use strict';
// 
//     const getMessages = (doc) => $c('.js-replyNewMessageContainer > article', doc);
// 
//     addFetchAllButton({
//       getMessages,
//       postsContainerEl: document.querySelector('.js-replyNewMessageContainer'),
//       findNextPageUrl: (doc) => doc.querySelector('.pageNav-jump--next')?.href
//     });
// 
//     addJsonExtractor({
//         getMessages,
//         getMessageId: (el) => el.id.replace('js-',''),
//         fields: {
//             author: (el) => el.getAttribute('data-author'),
//             posted: (el) => el.querySelector('time')?.getAttribute('datetime')?.split('+')[0],
//             votes:  (el) => el.querySelectorAll('.reactionsBar-link > bdi').length,
//             body: (el) => {
//                 const clone = el.querySelector('.js-messageContent article > div > .bbWrapper').cloneNode(true);
//                 clone.querySelectorAll('blockquote').forEach(e => e.remove());
//                 return clone.textContent.trim();
//             }
//         }
//     });
// })();