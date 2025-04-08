"use client";

import { title } from "@/components/primitives";
import ImageColorPicker from "@/components/tools/colorpicker";

export default function DocsPage() {
  return (
    <>
      <div>
        <h1 className={title()}>Docs</h1>
      </div>

      <div className="width-full">
        <ImageColorPicker />
      </div>
    </>
  );
}
