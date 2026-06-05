import WorldCupOddsBoard from "../../components/WorldCupOddsBoard";
import worldcupEvent from "../../data/specialEvents/worldcup.json";

export const metadata = {
  title: "World Cup 2026 Board",
  description: "Login-gated World Cup 2026 match market and prediction board."
};

export default function WorldCupBoardPage() {
  return <WorldCupOddsBoard matches={worldcupEvent.matches} />;
}
