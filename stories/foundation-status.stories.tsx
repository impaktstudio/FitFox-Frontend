import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { FoundationStatus } from "@/components/foundation/foundation-status";

const meta = {
  title: "Foundation/FoundationStatus",
  component: FoundationStatus,
  parameters: {
    layout: "fullscreen"
  }
} satisfies Meta<typeof FoundationStatus>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
