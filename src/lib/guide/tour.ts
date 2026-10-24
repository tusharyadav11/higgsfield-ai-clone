export type TourStep = {
  target: string; // data-testid
  route?: string;
  title: string;
  body: string;
  fill?: string; // type this into the target (textarea)
  select?: string; // choose this value in the target (<select>)
  autoClick?: boolean; // click the target on arrival
  confirm?: string; // primary button label that clicks the target
};
export type TourKey = "main" | "first-video" | "claim";

export const FIRST_PROMPT = "A paper boat drifting down a neon-lit city street in the rain, cinematic, slow motion";

export const TOURS: Record<TourKey, TourStep[]> = {
  main: [
    { target: "nav-create", title: "Create is home base", body: "Every image and video starts here. Tap it any time." },
    { target: "credits-chip", title: "Your credits", body: "Each generation costs a few credits. You start with 50 free." },
    { target: "prompt-input", route: "/create", title: "Describe what you want", body: "Type a sentence about what you want to see. Short and specific works best." },
    { target: "surprise-btn", title: "No idea? Surprise me", body: "One click fills a great random prompt and model." },
    { target: "model-select", title: "Pick a model", body: "Fast models are cheap for trying ideas; quality models look best." },
    { target: "generate-btn", title: "Press Generate", body: "Your result appears in seconds and is saved to your Library." },
    { target: "remix-btn", route: "/explore", title: "Remix anything", body: "Love a post? Remix reuses its prompt as your starting point." },
    { target: "streak-claim", route: "/", title: "Free credits daily", body: "Claim once a day to grow your streak and earn credits." },
  ],
  "first-video": [
    { target: "kind-video", route: "/create", autoClick: true, title: "Switch to Video", body: "I will tap Video for you so you see video models." },
    { target: "model-select", select: "kling-fast", title: "A fast, cheap video model", body: "Kling Fast is a great first pick: quick and low cost." },
    { target: "prompt-input", fill: "A paper boat drifting down a neon-lit city street in the rain, cinematic, slow motion", title: "I wrote a prompt for you", body: "Edit it if you like. Describing subject, place and style is all it takes." },
    { target: "generate-btn", confirm: "Generate it for me", title: "Ready to make your video", body: "Press the button and I will click Generate for you." },
  ],
  claim: [{ target: "streak-claim", route: "/", title: "Claim your daily credits", body: "Press this once a day to add credits and grow your streak." }],
};
