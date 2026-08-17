# Bewerber AI

Bewerber AI is an open-source web application designed to help job seekers organize and manage the job application process.

The project brings important parts of the application workflow together in one place, including CV creation, cover letters, application management, company management, and email-based application workflows.

## ✨ Features

- 📄 CV builder and CV management
- ✉️ Cover letter creation and management
- 📋 Job application management
- 🏢 Company management
- 📧 Gmail integration for application emails
- 🚀 Server-side email delivery
- 📎 Secure email attachment handling
- 🌍 Multilingual interface
  - 🇩🇪 German
  - 🇬🇧 English
  - 🇸🇦 Arabic
- ↔️ Arabic RTL interface support
- 🔐 Authentication and protected application data
- 🗄️ Supabase-backed database
- 📊 Application and email status tracking

## 🛠️ Tech Stack

- Next.js
- React
- TypeScript
- Supabase
- Gmail API
- Tailwind CSS

## 🎯 Project Goal

The goal of Bewerber AI is to make the job application process more organized and easier to manage, especially for people applying for jobs and Ausbildung opportunities in Germany.

Instead of managing CVs, cover letters, companies, applications, and application emails across multiple tools, Bewerber AI aims to provide a unified workflow.

## 🌍 Multilingual Support

The application supports:

- German
- English
- Arabic

Arabic includes RTL (right-to-left) interface support.

## 🔐 Privacy & Security

The project is designed with server-side handling of sensitive operations in mind.

Gmail authentication is separated from the application's login system. OAuth tokens are handled server-side and stored encrypted rather than being exposed to the browser.

Email delivery is performed server-side, and email attachments are intended to remain server-side rather than exposing their contents to the browser.

Sensitive credentials and environment variables must never be committed to the repository.

## 🚧 Project Status

Bewerber AI is currently under active development and testing.

Features and architecture may continue to evolve as the project is improved and tested.

## 🚀 Getting Started

### Requirements

- Node.js
- npm
- Supabase project
- Gmail API / OAuth configuration for email functionality

### Installation

Clone the repository:

```bash
git clone https://github.com/mustaphadrif/bewerber-ai.git
cd bewerber-ai
