export interface Highscore {
  id: number;
  nickname: string;
  score: number;
  dateCreated: string; // ISO 8601
  region: string;
  game: string;
}

export interface RankedHighscore extends Highscore {
  position: number;
}

export interface CreateHighscoreInput {
  nickname: string;
  score: number;
  region: string;
  game: string;
}
