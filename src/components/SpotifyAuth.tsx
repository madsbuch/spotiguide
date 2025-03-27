import { useEffect, useState } from "react";
import { SpotifyApi } from "@spotify/web-api-ts-sdk";
import { useStore } from "../store/useStore";

const SPOTIFY_CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
const REDIRECT_URI = import.meta.env.VITE_REDIRECT_URI;

const scopes = [
  "user-read-private",
  "user-read-email",
  "playlist-read-private",
  "playlist-read-collaborative",
  "streaming",
  "user-read-playback-state",
  "user-modify-playback-state",
];

export default function SpotifyAuth() {
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const { setSpotifyApi, spotifyApi } = useStore();

  useEffect(() => {
    const initializeSpotify = async () => {
      try {
        console.log("Initializing Spotify SDK...");

        // Check if we're returning from auth redirect with hash fragment (implicit flow)
        if (window.location.hash) {
          console.log("Hash fragment detected, parsing token");

          // Parse the hash fragment
          const hashParams = new URLSearchParams(
            window.location.hash.substring(1)
          );
          const accessToken = hashParams.get("access_token");
          const expiresIn = hashParams.get("expires_in");

          // Clean URL
          window.history.replaceState(
            {},
            document.title,
            window.location.pathname
          );

          if (accessToken) {
            console.log("Access token found in URL");

            // Create SDK with the access token
            // We need to cast to AccessToken because the implicit flow doesn't provide a refresh token
            const token = {
              access_token: accessToken,
              expires_in: parseInt(expiresIn || "3600"),
              token_type: "Bearer",
              refresh_token: "", // Implicit flow doesn't provide a refresh token
            };

            // Create SDK with the access token
            const sdk = SpotifyApi.withAccessToken(
              SPOTIFY_CLIENT_ID,
              token as import("@spotify/web-api-ts-sdk").AccessToken
            );

            // Verify the token by fetching the user profile
            try {
              const profile = await sdk.currentUser.profile();
              console.log("User profile fetched:", profile.display_name);

              // Store the SDK instance in our global store
              setSpotifyApi(sdk);
            } catch (profileError) {
              console.error("Failed to fetch user profile:", profileError);
              setAuthError(
                "Failed to verify authentication. Please try again."
              );
            }
          }
        } else {
          // Try to initialize SDK with user authorization
          try {
            const sdk = SpotifyApi.withUserAuthorization(
              SPOTIFY_CLIENT_ID,
              REDIRECT_URI,
              scopes
            );

            // Check if we're already authenticated
            const accessToken = await sdk.getAccessToken();

            if (accessToken) {
              console.log("Access token found, verifying...");

              // Verify the token by fetching the user profile
              try {
                const profile = await sdk.currentUser.profile();
                console.log("User profile fetched:", profile.display_name);

                // Store the SDK instance in our global store
                setSpotifyApi(sdk);
              } catch (profileError) {
                console.error("Failed to fetch user profile:", profileError);
                // Not actually authenticated, show login button
              }
            } else {
              console.log("No access token found, showing login button");
            }
          } catch {
            console.log("Not authenticated, showing login button");
          }
        }
      } catch (error) {
        console.error("Spotify initialization error:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (!isRedirecting) {
      initializeSpotify();
    }
  }, [setSpotifyApi, isRedirecting]);

  const handleLogin = () => {
    // Prevent multiple redirects
    if (isRedirecting) return;

    setIsRedirecting(true);

    // Redirect to Spotify authorization page using implicit grant flow
    const authUrl = `https://accounts.spotify.com/authorize?client_id=${SPOTIFY_CLIENT_ID}&response_type=token&redirect_uri=${encodeURIComponent(
      REDIRECT_URI
    )}&scope=${encodeURIComponent(scopes.join(" "))}&show_dialog=true`;

    console.log("Redirecting to Spotify auth:", authUrl);
    window.location.href = authUrl;
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-500 mr-2"></div>
        Loading...
      </div>
    );
  }

  if (!spotifyApi) {
    return (
      <div className="flex flex-col items-center justify-center p-4 gap-4">
        <h2 className="text-xl font-bold">Connect to Spotify</h2>
        <p className="text-gray-600 mb-4 text-center">
          Login with your Spotify account to access your playlists and create a
          custom radio experience.
        </p>

        {authError && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {authError}
          </div>
        )}

        <button
          onClick={handleLogin}
          disabled={isRedirecting}
          className={`bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded flex items-center gap-2 ${
            isRedirecting ? "opacity-50 cursor-not-allowed" : ""
          }`}
        >
          {isRedirecting ? "Redirecting..." : "Login with Spotify"}
        </button>
      </div>
    );
  }

  return null; // When authenticated, this component doesn't render anything
}
