import "./index.css";
import { Composition } from "remotion";
import { RadarDemo } from "./Composition";

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="ArvexoRadarDemo" component={RadarDemo} durationInFrames={1800} fps={30} width={1920} height={1080} />
    <Composition id="ArvexoRadarVertical" component={RadarDemo} durationInFrames={1800} fps={30} width={1080} height={1920} />
  </>
);
