import appLogo from "/favicon.svg";
import PWABadge from "./PWABadge.tsx";
import SpotifyAuth from "./components/SpotifyAuth";
import PlaylistSelector from "./components/PlaylistSelector";
import RadioPlayer from "./components/RadioPlayer";
import { useStore } from "./store/useStore";
import "./App.css";

function App() {
  const { spotifyApi, selectedPlaylist } = useStore();

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="flex items-center justify-center mb-8">
        <img src={appLogo} className="h-16 mr-4" alt="spotiguide logo" />
        <h1 className="text-3xl font-bold">Spotiguide</h1>
      </div>

      <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
        <SpotifyAuth />

        {spotifyApi && !selectedPlaylist && <PlaylistSelector />}

        {spotifyApi && selectedPlaylist && <RadioPlayer />}
      </div>

      <footer className="text-center text-gray-500 text-sm mt-8">
        <PWABadge />
        <p className="mt-2">
          Mix your Spotify playlists with AI-generated speech
        </p>
      </footer>
    </div>
  );
}

export default App;
