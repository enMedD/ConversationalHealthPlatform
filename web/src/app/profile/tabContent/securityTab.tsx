import { Button } from "@/components/ui/button";
import { User as UserTypes } from "@/lib/types";
import Image from "next/image";
import { User } from "lucide-react";
import Logo from "../../../../public/logo.png";

export default function SecurityTab({ user }: { user: UserTypes | null }) {
  return (
    <>
      <div className="flex py-8 border-b">
        <div className="w-[500px] text-sm">
          <span className="font-semibold text-inverted-inverted">
            Your Photo
          </span>
          <p className="pt-1">This will be displayed on your profile.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center bg-background rounded-full min-h-[65px] min-w-[65px] max-h-[65px] max-w-[65px] aspect-square text-2xl font-normal border-2 border-gray-900 py-2">
            {user && user.email ? (
              user.email[0].toUpperCase()
            ) : (
              <User size={25} className="mx-auto" />
            )}
          </div>
          <Button variant="link" className="text-error px-2">
            Delete
          </Button>
          <Button variant="link" className="px-2">
            Update
          </Button>
        </div>
      </div>

      <div className="py-8 border-b flex flex-col gap-5">
        <div className="flex items-center">
          <div className="w-[500px] text-sm">
            <span className="font-semibold text-inverted-inverted">Name</span>
          </div>
          <div className="w-[500px] h-10 flex items-center justify-between">
            <span className="font-semibold text-inverted-inverted">
              John Luis Jokic
            </span>{" "}
            <Button variant="outline">Edit</Button>
          </div>
        </div>
        <div className="flex items-center">
          <div className="w-[500px] text-sm">
            <span className="font-semibold text-inverted-inverted">Email</span>
          </div>
          <div className="w-[500px] h-10 flex items-center justify-between">
            <span className="font-semibold text-inverted-inverted">
              John Luis Jokic
            </span>{" "}
            <Button variant="outline">Edit</Button>
          </div>
        </div>
        <div className="flex items-center">
          <div className="w-[500px] text-sm">
            <span className="font-semibold text-inverted-inverted">Phone</span>
          </div>
          <div className="w-[500px] h-10 flex items-center justify-between">
            <span className="font-semibold text-inverted-inverted">
              John Luis Jokic
            </span>
            <Button variant="outline">Edit</Button>
          </div>
        </div>
      </div>

      {/*  <div className="flex py-8 border-b">
        <div className="w-[500px] text-sm">
          <span className="font-semibold text-inverted-inverted">
            Teamspaces Joined
          </span>
          <p className="w-3/4 pt-1">
            Easily switch between them and access both accounts from any device.
          </p>
        </div>
        <div className="flex flex-col gap-3 w-[500px]">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3">
              <Image src={Logo} alt="Logo" width={65} height={65} />
              <span className="font-semibold text-inverted-inverted">
                enMedD
              </span>
            </div>

            <Button variant="outline">Manage Team</Button>
          </div>
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3">
              <Image src={Logo} alt="Logo" width={65} height={65} />
              <span className="font-semibold text-inverted-inverted">
                enMedD
              </span>
            </div>

            <Button variant="outline">Manage Team</Button>
          </div>
        </div>
      </div> */}

      <div className="flex py-8 justify-end">
        <div className="flex gap-3">
          <Button>Save Changes</Button>
        </div>
      </div>
    </>
  );
}
