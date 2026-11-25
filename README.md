# Overview
AccessWay is an Android application designed to help people with reduced mobility and other accessibility needs to plan their visits to public places and tourist attractions. The application allows users to discover places on an interactive map and access practical information about their accessibility

# Repository overview
[`docs/`](docs) contains the documentation of both how the app was being develop thorought the course as well as the initial setup of the app in case of wanting to contribute towards the project.
Additional, raw documentation can be found on [Notion](https://app.notion.com/p/Mobile-Systems-Project-3f794243be478092ac8add311ba9b071?source=copy_link) where each week we documented our progress.

[`src/`](src) contains source code of the Android application, created with Expo + React Native. An Android emulator such as Android Virtual Device (avd) is recommended for development (installed by default with Android Studio).

[`prototype/`](prototype) contains prototype screens made in Figma. It includes 4 main screens Explore, Saved, Contribute and Preferences each in Light & High Contrast Mode.

# Development

1. Prerequisites
   - [Node.js](https://nodejs.org/)
   - [Android Studio](https://developer.android.com/studio) with an Android Virtual Device (AVD)

2. Install dependencies
   ```bash
   git clone https://github.com/Sofia906111/Travel-app
   cd src
   npm install
   ```

3. Configure environment
   Created `.env` with your Supabase credentials (you can duplicate `.env.example` and fill):
   ```bash
   EXPO_PUBLIC_SUPABASE_URL=...
   EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
   ```

4. Start an Android emulator
   ```bash
   emulator -avd <your_avd_name>
   ```

5. Run the app
   ```bash
   cd src
   npm run android
   ```

# Technologies
- [Supabase](https://supabase.com/) - used for storing user data and contributions records
- [Expo with React Native](https://expo.dev/) - the Android application development framework
- [Figma](https://www.figma.com) - for prototyping the design of screens
- [Notion](https://notion.com) - planning work, documenting progress and plans for the project development

# Team members
- Sofía Fernández 906111
- Sandra Chic 906258
- Leo Ryba 252575
