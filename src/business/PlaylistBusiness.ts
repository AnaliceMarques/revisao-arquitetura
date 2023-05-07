import { PlaylistDatabase } from "../database/PlaylistDatabase";
import {
  CreatePlaylistInputDTO,
  CreatePlaylistOutputDTO,
} from "../dtos/playlist/createPlaylist.dto";
import {
  DeletePlaylistInputDTO,
  DeletePlaylistOutputDTO,
} from "../dtos/playlist/deletePlaylist.dto";
import {
  EditPlaylistInputDTO,
  EditPlaylistOutputDTO,
} from "../dtos/playlist/editPlaylist.dto";
import {
  GetPlaylistsInputDTO,
  GetPlaylistsOutputDTO,
} from "../dtos/playlist/getPlaylists.dto";
import {
  LikeOrDislikePlaylistInputDTO,
  LikeOrDislikePlaylistOutputDTO,
} from "../dtos/playlist/likeOrDislikePlaylist.dto";
import { ForbiddenError } from "../errors/ForbiddenError";
import { NotFoundError } from "../errors/NotFoundError";
import { UnauthorizedError } from "../errors/UnauthorizedError";
import { LikeDislikeDB, Playlist, PLAYLIST_LIKE } from "../models/Playlist";
import { USER_ROLES } from "../models/User";
import { IdGenerator } from "../services/IdGenerator";
import { TokenManager } from "../services/TokenManager";

export class PlaylistBusines {
  constructor(
    private playlistDatabase: PlaylistDatabase,
    private idGenerator: IdGenerator,
    private tokenManager: TokenManager
  ) {}

  public createPlaylist = async (
    input: CreatePlaylistInputDTO
  ): Promise<CreatePlaylistOutputDTO> => {
    const { name, token } = input;

    const payload = this.tokenManager.getPayload(token);

    if (!payload) {
      throw new UnauthorizedError();
    }

    const id = this.idGenerator.generate();

    const playlist = new Playlist(
      id,
      name,
      0,
      0,
      new Date().toISOString(),
      new Date().toISOString(),
      payload.id,
      payload.name
    );

    const playlistDB = playlist.toDBModel();
    await this.playlistDatabase.insertPlaylist(playlistDB);

    const output: CreatePlaylistOutputDTO = undefined;

    return output;
  };

  public getPlaylists = async (
    input: GetPlaylistsInputDTO
  ): Promise<GetPlaylistsOutputDTO> => {
    const { token } = input;

    const payload = this.tokenManager.getPayload(token);

    if (!payload) {
      throw new UnauthorizedError();
    }

    const playlistsDBWithCreatorName =
      await this.playlistDatabase.getPlaylistsWithCreatorName();

    const playlists = playlistsDBWithCreatorName.map(
      (playlistsWithCreatorName) => {
        const playlist = new Playlist(
          playlistsWithCreatorName.id,
          playlistsWithCreatorName.name,
          playlistsWithCreatorName.likes,
          playlistsWithCreatorName.dislikes,
          playlistsWithCreatorName.created_at,
          playlistsWithCreatorName.updated_at,
          playlistsWithCreatorName.creator_id,
          playlistsWithCreatorName.creator_name
        );

        return playlist.toBusinessModel();
      }
    );
    const output: GetPlaylistsOutputDTO = playlists;

    return output;
  };

  public editPlaylist = async (
    input: EditPlaylistInputDTO
  ): Promise<EditPlaylistOutputDTO> => {
    const { name, token, idToEdit } = input;

    const payload = this.tokenManager.getPayload(token);

    if (!payload) {
      throw new UnauthorizedError();
    }

    const playlistDB = await this.playlistDatabase.findPlaylistById(idToEdit);

    if (!playlistDB) {
      throw new NotFoundError("playlist com essa id não existe");
    }

    if (payload.id !== playlistDB.creator_id) {
      throw new ForbiddenError("somente quem criou a playlist pode edita-la");
    }

    const playlist = new Playlist(
      playlistDB.id,
      playlistDB.name,
      playlistDB.likes,
      playlistDB.dislikes,
      playlistDB.created_at,
      playlistDB.updated_at,
      playlistDB.creator_id,
      payload.name
    );

    playlist.setName(name);
    playlist.setUpdatedAt(new Date().toISOString());

    const updatePlaylistDB = playlist.toDBModel();
    await this.playlistDatabase.updatePlaylist(updatePlaylistDB);

    const output: EditPlaylistOutputDTO = undefined;

    return output;
  };

  public deletePlaylist = async (
    input: DeletePlaylistInputDTO
  ): Promise<DeletePlaylistOutputDTO> => {
    const { token, idToDelete } = input;

    const payload = this.tokenManager.getPayload(token);

    if (!payload) {
      throw new UnauthorizedError();
    }

    const playlistDB = await this.playlistDatabase.findPlaylistById(idToDelete);

    if (!playlistDB) {
      throw new NotFoundError("playlist com essa id não existe");
    }

    if (payload.role !== USER_ROLES.ADMIN) {
      if (payload.id !== playlistDB.creator_id) {
        throw new ForbiddenError("somente quem criou a playlist pode apaga-la");
      }
    }

    await this.playlistDatabase.deletePlaylist(idToDelete);

    const output: DeletePlaylistOutputDTO = undefined;

    return output;
  };

  public likeOrDislikePlaylist = async (
    input: LikeOrDislikePlaylistInputDTO
  ): Promise<LikeOrDislikePlaylistOutputDTO> => {
    const { token, playlistId, like } = input;

    const payload = this.tokenManager.getPayload(token);

    if (!payload) {
      throw new UnauthorizedError();
    }

    const playlistDBWhitCreatorName =
      await this.playlistDatabase.findPlaylistWithCreatorNameById(playlistId);

    if (!playlistDBWhitCreatorName) {
      throw new NotFoundError("playlist com essa id não existe");
    }

    const playlist = new Playlist(
      playlistDBWhitCreatorName.id,
      playlistDBWhitCreatorName.name,
      playlistDBWhitCreatorName.likes,
      playlistDBWhitCreatorName.dislikes,
      playlistDBWhitCreatorName.created_at,
      playlistDBWhitCreatorName.updated_at,
      playlistDBWhitCreatorName.creator_id,
      playlistDBWhitCreatorName.creator_name
    );

    const likeSQlite = like ? 1 : 0;

    const likeDislikeDB: LikeDislikeDB = {
      user_id: payload.id,
      playlist_id: playlistId,
      like: likeSQlite,
    };

    const likeDislikeExists = await this.playlistDatabase.findLikeDislike(
      likeDislikeDB
    );

    if (likeDislikeExists === PLAYLIST_LIKE.ALREADY_LIKED) {
      if (like) {
        await this.playlistDatabase.removeLikeDislike(likeDislikeDB);
        playlist.removeLike();
      } else {
        await this.playlistDatabase.updateLikeDislike(likeDislikeDB);
        playlist.removeLike();
        playlist.addDislike();
      }
    } else if (likeDislikeExists === PLAYLIST_LIKE.ALREADY_DISLIKED) {
      if (!like) {
        await this.playlistDatabase.removeLikeDislike(likeDislikeDB);
        playlist.removeDislike();
      } else {
        await this.playlistDatabase.updateLikeDislike(likeDislikeDB);
        playlist.removeDislike();
        playlist.addLike();
      }
    } else {
      await this.playlistDatabase.insertLikeDislike(likeDislikeDB);
      like ? playlist.addLike() : playlist.addDislike();
    }

    const updatePlaylistDB = playlist.toDBModel();
    await this.playlistDatabase.updatePlaylist(updatePlaylistDB);

    const output: LikeOrDislikePlaylistOutputDTO = undefined;

    return output;
  };
}
