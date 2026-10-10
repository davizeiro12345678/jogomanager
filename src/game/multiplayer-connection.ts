export type LiveRoomConnectionState =
  | {
      pausePresentation: false;
      notice: null;
    }
  | {
      pausePresentation: true;
      notice: {
        title: string;
        detail: string;
      };
    };

/**
 * A queda de rede não encerra uma sala já iniciada. A simulação exibida neste
 * navegador fica pausada até que a inscrição em tempo real seja restabelecida;
 * o placar final continua pertencendo ao replay do servidor.
 */
export function getLiveRoomConnectionState(online: boolean): LiveRoomConnectionState {
  if (online) {
    return { pausePresentation: false, notice: null };
  }

  return {
    pausePresentation: true,
    notice: {
      title: "Reconectando à sala",
      detail:
        "A apresentação foi pausada. Quando a conexão voltar, o placar oficial continuará vindo do servidor.",
    },
  };
}
