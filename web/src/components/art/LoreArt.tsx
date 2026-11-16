/**
 * Storyline banner: the Audacity Game waterfront key art with a slow Ken Burns drift
 * (the drift is CSS, see .lore__art in story.css).
 */
export default function LoreArt() {
  return (
    <div className="lore__art" aria-hidden>
      <img className="lore__img" src="/story/welcome.jpg" alt="" draggable={false} />
    </div>
  );
}
