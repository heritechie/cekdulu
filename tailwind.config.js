/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: [
    "./index.html",
    "./src/**/*.{html,ts,svelte,jsx,js}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: "hsl(var(--primary))",
        "primary-foreground": "hsl(var(--primary-foreground))",
        secondary: "hsl(var(--secondary))",
        "secondary-foreground": "hsl(var(--secondary-foreground))",
        destructive: "hsl(var(--destructive))",
        "destructive-foreground": "hsl(var(--destructive-foreground))",
        muted: "hsl(var(--muted))",
        "muted-foreground": "hsl(var(--muted-foreground))",
        accent: "hsl(var(--accent))",
        "accent in andm “ and[.w and  and in and and and and and and L and  the  the a, the or and the project structure is set up correctly. Now let me continue implementing the design tokens and the homepage. I'll create a design tokens file and the global stylesheet.Let me check what Tailwind v4 expects and set up the config properly:
<tool_call>
<function=bash>
<parameter=command>
cd /home/masher/Workspaces/cekduru && ls tailwind.config* 2>/dev/null; npx tailwindcss --help 2>&1 | head -5