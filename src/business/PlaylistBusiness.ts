import { PlaylistDatabase } from "../database/PlaylistDatabase";
import { IdGenerator } from "../services/IdGenerator";
import { TokenManager } from "../services/TokenManager";

export class PlaylistBusines {
  constructor(
    private playlistDatabase: PlaylistDatabase,
    private idGenerator: IdGenerator,
    private tokenManager: TokenManager
  ) {}

  //endpoints
}
