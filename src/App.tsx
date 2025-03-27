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
      <div className="flex items-center justify-center mb-8 bg-spotify-black p-8 rounded-lg shadow-lg">
        <img src={appLogo} className="h-32 mr-6 logo" alt="spotiguide logo" />
        <div>
          <h1 className="text-6xl font-bold text-white">Spotiguide</h1>
          <p className="text-spotify-green text-lg">
            AI-Enhanced Spotify Experience
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
        <SpotifyAuth />

        {spotifyApi && !selectedPlaylist && <PlaylistSelector />}

        {spotifyApi && selectedPlaylist && <RadioPlayer />}
      </div>

      <footer className="text-center mt-8 p-4 bg-spotify-black rounded-lg shadow-lg">
        <PWABadge />
        <p className="mt-2 text-white">
          Mix your Spotify playlists with AI-generated speech
        </p>
        <p className="text-xs text-spotify-green mt-2">
          © {new Date().getFullYear()} Spotiguide
        </p>
      </footer>
    </div>
  );
}

export default App;
