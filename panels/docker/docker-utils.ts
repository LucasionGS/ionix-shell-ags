import { exec } from "ags/process"

export interface DockerPort {
  hostPort: string
  containerPort: string
  protocol: string
}

export interface DockerContainer {
  id: string
  name: string
  image: string
  status: string
  state: string
  ports: DockerPort[]
  project: string
  projectDir: string
}

const DOCKER_FORMAT =
  '{{.ID}}\t{{.Names}}\t{{.Image}}\t{{.Status}}\t{{.State}}\t{{.Ports}}\t{{.Label "com.docker.compose.project"}}\t{{.Label "com.docker.compose.project.working_dir"}}'

export const DOCKER_PS_CMD = ["docker", "ps", "-a", "--format", DOCKER_FORMAT]

export function parseContainerOutput(output: string): DockerContainer[] {
  if (!output.trim()) return []

  return output
    .trim()
    .split("\n")
    .map((line) => {
      const parts = line.split("\t")
      return {
        id: parts[0] || "",
        name: parts[1] || "",
        image: parts[2] || "",
        status: parts[3] || "",
        state: parts[4] || "",
        ports: parsePorts(parts[5] || ""),
        project: parts[6] || "",
        projectDir: parts[7] || "",
      }
    })
}

function parsePorts(portsStr: string): DockerPort[] {
  if (!portsStr.trim()) return []

  const ports: DockerPort[] = []
  for (const part of portsStr.split(", ")) {
    // Formats: 0.0.0.0:8080->80/tcp  :::8080->80/tcp  80/tcp
    const match = part.match(/(?:.*?:(\d+)->)?(\d+)\/(tcp|udp)/)
    if (match) {
      ports.push({
        hostPort: match[1] || "",
        containerPort: match[2],
        protocol: match[3],
      })
    }
  }
  return ports
}

export function listContainers(): DockerContainer[] {
  try {
    const output = exec(DOCKER_PS_CMD)
    return parseContainerOutput(output)
  } catch {
    return []
  }
}

export function formatPorts(ports: DockerPort[]): string {
  if (ports.length === 0) return ""
  return ports
    .map((p) =>
      p.hostPort
        ? `${p.hostPort} \u2192 ${p.containerPort}/${p.protocol}`
        : `${p.containerPort}/${p.protocol}`,
    )
    .join("  ")
}
