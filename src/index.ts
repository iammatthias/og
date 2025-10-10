import { ImageResponse } from "workers-og";
import NewYorkFontData from "../new-york-medium_regular.ttf";

// RGB colors converted from display-p3 values in globals.css
const COLORS = {
  background: "rgb(15, 20, 25)",
  foreground: "rgb(242, 250, 239)",
  accent: "rgb(255, 191, 0)",
};

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Parse the OG image request from pathname
    // Routes: / (homepage), /posts (category), /posts-my-title (content)
    let path: string | undefined;
    let title: string | undefined;

    if (pathname === "/" || pathname === "") {
      // Homepage - no path or title
      path = undefined;
      title = undefined;
    } else {
      // Remove leading slash
      const cleanPath = pathname.substring(1);

      // Split on first dash to get path and title
      const firstDashIndex = cleanPath.indexOf("-");
      if (firstDashIndex === -1) {
        // Category page (e.g., /posts)
        path = cleanPath;
        title = undefined;
      } else {
        // Content page (e.g., /posts-my-title)
        path = cleanPath.substring(0, firstDashIndex);
        title = decodeURIComponent(cleanPath.substring(firstDashIndex + 1));
      }
    }

    // Font data is loaded as Uint8Array
    const NewYorkFont = (NewYorkFontData as any).buffer || NewYorkFontData;

    // Generate HTML based on what we have
    let html: string;

    if (!path && !title) {
      // Homepage
      html = `
        <div style="
          display: flex;
          width: 1200px;
          height: 628px;
          background: ${COLORS.background};
          border: 2px solid ${COLORS.accent};
          padding: 60px;
          box-sizing: border-box;
          align-items: center;
          justify-content: center;
          font-family: 'New York', serif;
        ">
          <div style="
            display: flex;
            font-size: 72px;
            color: ${COLORS.foreground};
          ">
            @iammatthias
          </div>
        </div>
      `;
    } else if (path && !title) {
      // Category page
      html = `
        <div style="
          display: flex;
          width: 1200px;
          height: 628px;
          background: ${COLORS.background};
          border: 2px solid ${COLORS.accent};
          padding: 60px;
          box-sizing: border-box;
        ">
          <div style="
            display: flex;
            flex-direction: column;
            width: 100%;
            height: 100%;
            justify-content: space-between;
            font-family: 'New York', serif;
          ">
            <div style="
              font-size: 42px;
              color: ${COLORS.foreground};
              opacity: 0.8;
            ">
              @iammatthias
            </div>
            <div style="
              font-size: 84px;
              color: ${COLORS.foreground};
              text-transform: capitalize;
            ">
              ${path}
            </div>
          </div>
        </div>
      `;
    } else {
      // Content page
      html = `
        <div style="
          display: flex;
          width: 1200px;
          height: 628px;
          background: ${COLORS.background};
          border: 2px solid ${COLORS.accent};
          padding: 60px;
          box-sizing: border-box;
        ">
          <div style="
            display: flex;
            flex-direction: column;
            width: 100%;
            height: 100%;
            justify-content: space-between;
            font-family: 'New York', serif;
          ">
            <div style="
              font-size: 42px;
              color: ${COLORS.foreground};
              opacity: 0.8;
            ">
              @iammatthias
            </div>
            <div style="
              display: flex;
              flex-direction: column;
              gap: 16px;
            ">
              <div style="
                font-size: 28px;
                color: ${COLORS.accent};
                text-transform: capitalize;
              ">
                ${path}
              </div>
              <div style="
                font-size: 64px;
                color: ${COLORS.foreground};
              ">
                ${title}
              </div>
            </div>
          </div>
        </div>
      `;
    }

    return new ImageResponse(html, {
      width: 1200,
      height: 628,
      fonts: [
        {
          name: "New York",
          data: NewYorkFont,
          style: "normal",
          weight: 400,
        },
      ],
      debug: false,
    });
  },
};
