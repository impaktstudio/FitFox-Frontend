import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Badge } from "@/components/ui/badge";

const meta = {
  title: "UI/Badge",
  component: Badge,
  tags: ["autodocs"],
  args: {
    children: "configured"
  }
} satisfies Meta<typeof Badge>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Success: Story = {
  args: {
    variant: "success"
  }
};

export const Warning: Story = {
  args: {
    variant: "warning",
    children: "disabled"
  }
};

export const Danger: Story = {
  args: {
    variant: "danger",
    children: "failed"
  }
};
