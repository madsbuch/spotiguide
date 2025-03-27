import { useEffect, useState } from "react";
import { useStore } from "../store/useStore";
import type { Playlist } from "../store/types";

export default function PlaylistSelector() {
  const [isLoading, setIsLoading] = useState(false);
  const {
    spotifyApi,
    playlists,
    setPlaylists,
    selectedPlaylist,
    setSelectedPlaylist,
    setSpotifyApi,
  } = useStore();

  useEffect(() => {
    const fetchPlaylists = async () => {
      if (!spotifyApi) return;

      setIsLoading(true);
      try {
        console.log("Fetching playlists...");

        // Check if the access token is valid
        try {
          // Try to get the user profile first to verify the token
          const userProfile = await spotifyApi.currentUser.profile();
          console.log(
            "User profile fetched successfully:",
            userProfile.display_name
          );
        } catch (profileError) {
          console.error("Error fetching user profile:", profileError);
          throw new Error(
            "Failed to authenticate with Spotify. Please try logging in again."
          );
        }

        // Fetch user's playlists
        console.log("Fetching user playlists...");
        const response = await spotifyApi.currentUser.playlists.playlists(50);
        console.log("Playlists fetched:", response.items.length);

        // Process playlists
        const fetchedPlaylists = await Promise.all(
          response.items.map(async (item) => {
            console.log(`Fetching tracks for playlist: ${item.name}`);
            // Fetch tracks for each playlist
            const tracksResponse = await spotifyApi.playlists.getPlaylistItems(
              item.id,
              undefined,
              undefined,
              50
            );

            // Process tracks
            const tracks = tracksResponse.items.map((trackItem) => {
              const track = trackItem.track;
              return {
                id: track.id,
                name: track.name,
                artists: track.artists.map((artist) => artist.name),
                uri: track.uri,
                albumImageUrl: track.album.images[0]?.url || "",
              };
            });

            console.log(
              `Processed ${tracks.length} tracks for playlist: ${item.name}`
            );
            return {
              id: item.id,
              name: item.name,
              description: item.description,
              imageUrl: item.images[0]?.url || null,
              tracks,
            };
          })
        );

        console.log("All playlists processed:", fetchedPlaylists.length);
        setPlaylists(fetchedPlaylists);
      } catch (err: unknown) {
        console.error("Error fetching playlists:", err);
        // If there's an authentication error, we might need to reset the Spotify API
        const error = err as { message?: string; status?: number };
        if (error.message?.includes("authenticate") || error.status === 401) {
          console.log("Authentication error detected, resetting Spotify API");
          // Reset the Spotify API instance
          setSpotifyApi(null);
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchPlaylists();
  }, [spotifyApi, setPlaylists, setSpotifyApi]);

  if (!spotifyApi) {
    return null;
  }

  if (isLoading) {
    return <div className="p-4">Loading playlists...</div>;
  }

  if (playlists.length === 0) {
    return (
      <div className="p-4">
        <p>No playlists found. Create some playlists in Spotify first.</p>
      </div>
    );
  }

  const handleSelectPlaylist = (playlist: Playlist) => {
    setSelectedPlaylist(playlist);
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Select a Playlist</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {playlists.map((playlist) => (
          <div
            key={playlist.id}
            className={`border rounded-lg p-4 cursor-pointer transition-all ${
              selectedPlaylist?.id === playlist.id
                ? "border-green-500 bg-green-50"
                : "border-gray-200 hover:border-gray-300"
            }`}
            onClick={() => handleSelectPlaylist(playlist)}
          >
            <div className="flex items-center gap-3">
              {playlist.imageUrl && (
                <img
                  src={playlist.imageUrl}
                  alt={playlist.name}
                  className="w-16 h-16 object-cover rounded"
                />
              )}
              <div>
                <h3 className="font-medium">{playlist.name}</h3>
                <p className="text-sm text-gray-500">
                  {playlist.tracks.length} tracks
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
