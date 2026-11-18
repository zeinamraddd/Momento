import { Link } from "react-router-dom";

import beachImage from "../../assets/momento/shared/illustration-beach.png";
import palmImage from "../../assets/momento/shared/illustration-palm.png";

function AlbumPreview({ space }) {

  // Keep the selected space when opening Shared Albums
  const albumsPath = space?.id
    ? `/albums?space=${encodeURIComponent(space.id)}`
    : "/spaces";

  return (
    <section className="momento-albums-preview">

      <h2>Shared albums</h2>

      <div className="momento-albums-preview__photos">

        {/* First Polaroid */}
        <div className="momento-preview-polaroid momento-preview-polaroid--first">

          <img
            src={beachImage}
            alt="Illustrated beach sunset"
          />

        </div>

        {/* Second Polaroid */}
        <div className="momento-preview-polaroid momento-preview-polaroid--second">

          <img
            src={palmImage}
            alt="Illustrated palm tree on a beach"
          />

        </div>

      </div>

      {/* Open Shared Albums */}
      <Link
        to={albumsPath}
        className="momento-albums-preview__button"
      >
        Open our albums →
      </Link>

    </section>
  );
}

export default AlbumPreview;
