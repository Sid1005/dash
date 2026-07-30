# iOS Shortcut: Three

One shortcut can log spending, tasks, and workouts or answer spending/workout questions.

## Main flow

1. Add **Ask for Input** with the prompt `What do you want to log or ask?` and input type **Text**. Dictation from the keyboard works, or replace it with **Dictate Text** for a voice-first shortcut.
2. Add a **Dictionary** with one key: `input` = the Ask for Input result.
3. Add **Get Contents of URL**:
   - URL: `https://dash-focused.vercel.app/api/shortcut`
   - Method: `POST`
   - Request Body: `JSON`
   - JSON body: the Dictionary from step 2
4. Get the `message` value from the returned dictionary.
5. Add **Show Result** (and optionally **Speak Text**) using `message`.

## Workout-title follow-up

Immediately after **Get Contents of URL**:

1. Get `needs_follow_up` from the response.
2. Add an **If** action: if `needs_follow_up` is true.
3. Inside the If, get `follow_up.prompt`, `follow_up.session_id`, and add **Ask for Input** using the prompt.
4. Add a Dictionary containing:
   - `action`: `title_workout`
   - `session_id`: the returned session ID
   - `title`: the second Ask for Input result
5. Call the same URL again with the same POST configuration and the new Dictionary as JSON.
6. Show the second response's `message`.

The API persists the first exercise before asking for a title. Later exercise logs within three hours of that first log are appended to the same session.

## Phrases to use

- `spent 320 on dinner`
- `task: call Ram tomorrow at 7pm`
- `bicep curls 3 sets of 12 at 10kg`
- `last bicep workout`
- `tell me my chest workout in the week of 23rd to 30th June`
- `how much did I spend on travel in June?`

Apple documents that [Get Contents of URL supports POST requests](https://support.apple.com/en-au/guide/shortcuts/apd58d46713f/ios) with JSON bodies, while [Ask for Input](https://support.apple.com/guide/shortcuts/use-the-ask-for-input-action-apd68b5c9161/ios) is designed for logging flows and passes its answer to subsequent actions. Apple also documents how Shortcuts [builds and reads JSON dictionaries](https://support.apple.com/en-in/guide/shortcuts/apd0f2e057df/ios).
