import { createCredentialUser } from "../src/server/auth/create-credential-user";
import { prisma } from "../src/lib/prisma";
import readline from "readline/promises";
import { Writable } from "stream";

async function promptPassword(): Promise<string> {
  const isTTY = process.stdin.isTTY;
  if (!isTTY) {
    const fromEnv = process.env.ADMIN_PASSWORD;
    if (fromEnv) return fromEnv;
    throw new Error(
      "Not running in TTY and ADMIN_PASSWORD environment variable is not set"
    );
  }

  let muted = false;
  // Create a writable stream that can swallow output when muted is true
  const mutableStdout = new Writable({
    write(chunk, encoding, callback) {
      if (!muted) {
        process.stdout.write(chunk, encoding);
      }
      callback();
    },
  });

  const rl = readline.createInterface({
    input: process.stdin,
    output: mutableStdout,
    terminal: true,
  });

  process.stdout.write("Password (min 8 chars, input hidden): ");
  muted = true;
  const password = await rl.question("");
  muted = false;
  process.stdout.write("\n");

  process.stdout.write("Confirm Password: ");
  muted = true;
  const confirm = await rl.question("");
  muted = false;
  process.stdout.write("\n");

  rl.close();

  if (password !== confirm) {
    throw new Error("Passwords do not match.");
  }

  return password;
}

async function main() {
  console.log("Bootstrap Initial Admin User");
  console.log("----------------------------");

  try {
    const count = await prisma.user.count();
    if (count > 0) {
      console.error(
        "Error: Users already exist in the database. Bootstrap aborted."
      );
      process.exitCode = 1;
      return;
    }

    const rlInput = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const emailRaw = await rlInput.question("Admin Email: ");
    const nameRaw = await rlInput.question("Admin Name (Full Name): ");
    rlInput.close();

    const email = emailRaw.trim();
    const name = nameRaw.trim();

    if (!email || !name) {
      console.error("Error: Email and Name cannot be empty.");
      process.exitCode = 1;
      return;
    }

    const password = await promptPassword();

    const user = await createCredentialUser({
      email,
      name,
      password,
      isBootstrap: true,
    });

    console.log(`\nSuccess! Admin user created.`);
    console.log(`ID: ${user.id}`);
    console.log(`Email: ${user.email}`);
  } catch (err) {
    console.error(
      `\nError: ${err instanceof Error ? err.message : String(err)}`
    );
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
