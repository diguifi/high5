export type AppVariables = {
  game: string;
  criptKey: string;
  highscorePayload: {
    nickname: string;
    score: number;
    region: string;
  };
};

export type AppEnv = {
  Variables: AppVariables;
};
