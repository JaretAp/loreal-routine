Students are beginners learning the basics of JavaScript, APIs and OpenAI.

We use OpenAI's `gpt-4o` model, unless asked to use a different model.

We provide comments to help students understand each part of the generated code.

We do NOT use npm libraries or Node SDKs to make requests to APIs.

We use `async/await` when fetching data from an API.

We provide the simplest, beginner-friendly code possible.

We do NOT use `export` statements. Instead we link to JS files from `index.html`.

We use `const` and `let` for variables and template literals for string formatting and DOM insertion.

We use a `messages` parameter instead of `prompt` for the OpenAI API, and check for `data.choices[0].message.content`.

Project Requirements (Full Points Only)
- Product selection must toggle items, update their visual state (border/highlight), and keep the selected list above the button in sync.
- Clicking **Generate Routine** must send the selected products to the OpenAI API and render the personalized routine in the chat window.
- Follow-up chat needs to accept additional user questions and respond with context-aware answers that reflect the earlier conversation.
- Selected products should persist through a page reload and be removable or clearable by the user at any time.
- Product descriptions have to be easy to read and access (hover overlay, modal, toggle, expanded card, etc.).
- All API requests should go through a Cloudflare Worker so the OpenAI key never appears in the browser; use `https://loreal-worker.jaretva.workers.dev`.
- (LevelUp) Web search integration should let the chatbot cite fresh, real-world information with visible links or citations.
- (LevelUp) Product search must filter by name/keyword in real time, showing matches alongside the existing category filters.
- (LevelUp) RTL mode should flip the layout so the product grid, selected list, and chat UI all behave correctly for right-to-left languages.
